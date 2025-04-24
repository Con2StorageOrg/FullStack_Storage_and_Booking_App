import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { CreateBookingDto } from "../dto/create-booking.dto";

@Injectable()
export class BookingService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // 1. get all orders
  async getAllOrders(userId: string) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    const { data: orders, error } = await supabase.from("orders").select(`
      *,
      order_items (
        *,
        storage_items (
          translations,
          storage_locations (
            name
          )
        )
      )
    `);

    if (error) {
      console.error("Supabase error in getAllOrders():", error);
      throw new BadRequestException("Could not load orders");
    }
    if (!orders || orders.length === 0) {
      throw new BadRequestException("No orders found");
    }

    // get corresponding user profile for each booking (via user_id)
    const ordersWithUserProfiles = await Promise.all(
      orders.map(async (order) => {
        let user: { name: string; email: string } | null = null;

        if (order.user_id) {
          const { data: userData } = await supabase
            .from("user_profiles")
            .select("full_name, email")
            .eq("id", order.user_id)
            .maybeSingle();

          if (userData) {
            user = {
              name: userData.full_name,
              email: userData.email,
            };
          }
        }

        const itemWithNamesAndLocation =
          order.order_items?.map((item) => ({
            ...item,
            item_name:
              item.storage_items?.translations?.en?.item_name ?? "Unknown",
            location_name:
              item.storage_items?.storage_locations?.name ?? "Unknown",
          })) ?? [];

        return {
          ...order,
          user_profile: user,
          order_items: itemWithNamesAndLocation,
        };
      }),
    );

    return ordersWithUserProfiles;
  }

  // 2. get all bookings of a user
  async getUserBookings(userId: string) {
    if (!userId || userId === "undefined") {
      throw new BadRequestException("Valid user ID is required");
    }

    const supabase = await this.supabaseService.getClientByRole(userId);

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          *,
          storage_items (
            translations,
            location_id
          )
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        `Supabase error in getUserBookings(): ${JSON.stringify(error)}`,
      );
      throw new Error(`Failed to fetch user bookings: ${error.message}`);
    }

    if (!orders || orders.length === 0) {
      return [];
    }

    // Get unique location_ids from all order_items
    const locationIds = Array.from(
      new Set(
        orders
          .flatMap((order) => order.order_items ?? [])
          .map((item) => item.storage_items?.location_id)
          .filter((id): id is string => !!id),
      ),
    );

    // Load all relevant storage locations
    const { data: locationsData, error: locationError } = await supabase
      .from("storage_locations")
      .select("id, name")
      .in("id", locationIds);

    if (locationError) {
      console.error(
        `Supabase error loading locations: ${JSON.stringify(locationError)}`,
      );
      throw new Error(`Failed to fetch locations: ${locationError.message}`);
    }

    const locationMap = new Map(
      (locationsData ?? []).map((loc) => [loc.id, loc.name]),
    );

    // Add location_name and item_name to each item
    const ordersWithNames = orders.map((order) => ({
      ...order,
      order_items: order.order_items?.map((item) => ({
        ...item,
        item_name: item.storage_items?.translations?.en?.item_name ?? "Unknown",
        location_name:
          locationMap.get(item.storage_items?.location_id) ??
          "Unknown Location",
      })),
    }));

    return ordersWithNames;
  }

  // 3. create a Booking
  async createBooking(dto: CreateBookingDto) {
    const userId = dto.user_id;

    if (!userId) {
      throw new BadRequestException("No userId found: user_id is required");
    }

    const supabase = await this.supabaseService.getClientByRole(userId);

    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new BadRequestException("User not found");
    }

    const unavailableItems: string[] = [];

    // check for overlapping bookings
    for (const item of dto.items) {
      const start = new Date(item.start_date);
      const end = new Date(item.end_date);

      // get all overlapping orders and their quantities
      const { data: overlappingOrders, error: overlapError } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("item_id", item.item_id)
        .or(
          `and(start_date.lte.${item.end_date},end_date.gte.${item.start_date})`,
        );

      if (overlapError) {
        console.error("Overlap check error:", overlapError);
        throw new BadRequestException("Could not check overlapping bookings");
      }

      const alreadyBookedQuantity =
        overlappingOrders?.reduce((sum, o) => sum + (o.quantity ?? 0), 0) ?? 0;

      // get max availability from storage_items
      const { data: itemData, error: itemError } = await supabase
        .from("storage_items")
        .select("items_number_total")
        .eq("id", item.item_id)
        .single();

      if (itemError || !itemData) {
        throw new BadRequestException("Item data not found");
      }

      // check availability
      if (alreadyBookedQuantity + item.quantity > itemData.items_number_total) {
        throw new BadRequestException(
          `Not enough quantity available for item ${item.item_id}`,
        );
      }
    }

    // generate the order number
    const generateOrderNumber = () => {
      const now = new Date();
      const datePart = now.toISOString().split("T")[0].replace(/-/g, "");
      const randomPart = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
      return `ORD-${datePart}-${randomPart}`;
    };
    // TODO: invoice number - should be created here?

    // insert new order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending",
        order_number: generateOrderNumber(),
        // total_amount: dto.total_amount,
        // final amount: dto.total_amount,
        // payment_status are now nullable in database (maybe turn this into not null later again)
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new BadRequestException("Could not create order");
    }

    // Insert order items and calculate days
    for (const item of dto.items) {
      const start = new Date(item.start_date);
      const end = new Date(item.end_date);
      const totalDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      // get location_id from storage_items
      const { data: storageItem, error: storageError } = await supabase
        .from("storage_items")
        .select("location_id")
        .eq("id", item.item_id)
        .single();

      if (storageError || !storageItem) {
        console.error("Storage item fetch error (location_id):", storageError);
        throw new BadRequestException(
          `Could not fetch location_id for item ${item.item_id}`,
        );
      }

      const { error: itemInsertError } = await supabase
        .from("order_items")
        .insert({
          order_id: order.id,
          item_id: item.item_id,
          location_id: storageItem.location_id,
          quantity: item.quantity,
          start_date: item.start_date,
          end_date: item.end_date,
          total_days: totalDays,
          status: "pending",
        });

      if (itemInsertError) {
        console.error("Order item insert error:", itemInsertError);
        throw new BadRequestException("Could not create order items");
      }
    }

    return order;
  }

  // 4. confirm a Booking
  async confirmBooking(orderId: string, userId: string) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    // Get all the order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("item_id, quantity")
      .eq("order_id", orderId);

    if (itemsError) {
      throw new BadRequestException("Could not load order items");
    }

    // check availability of the items
    for (const item of items) {
      // get availability of item
      const { data: storageItem, error: storageItemError } = await supabase
        .from("storage_items")
        .select("items_number_available")
        .eq("id", item.item_id)
        .single();

      if (storageItemError || !storageItem) {
        throw new BadRequestException("Could not fetch storage item details");
      }

      // check if stock is enough
      if (storageItem.items_number_available < item.quantity) {
        throw new BadRequestException(
          `Not enough available quantity for item ${item.item_id}`,
        );
      }

      // reduce availability directly in `storage_items`
      const { error: reduceError } = await supabase
        .from("storage_items")
        .update({
          items_number_available:
            storageItem.items_number_available - item.quantity,
        })
        .eq("id", item.item_id);

      if (reduceError) {
        throw new BadRequestException(
          `Failed to reduce stock for item ${item.item_id}`,
        );
      }
    }

    // Change the order status to 'confirmed'
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId);

    if (updateError) {
      throw new BadRequestException("Could not confirm booking");
    }

    // Change the order items' status to 'confirmed'
    const { error: itemsUpdateError } = await supabase
      .from("order_items")
      .update({ status: "confirmed" })
      .eq("order_id", orderId);

    if (itemsUpdateError) {
      throw new BadRequestException("Could not confirm order items");
    }

    return { message: "Booking confirmed" };
  }

  // 5. update a Booking (Admin/SuperVera OR Owner)
  async updateBooking(orderId: string, userId: string, updatedItems: any[]) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    const { data: order } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .single();

    if (!order) throw new BadRequestException("Order not found");

    const { data: user } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!user) {
      throw new BadRequestException("User not found");
    }

    const isAdmin = user?.role === "admin" || user?.role === "superVera";
    if (
      !(
        user.role === "admin" ||
        userId === order.user_id ||
        user.role === "service_role"
      )
    ) {
      throw new ForbiddenException("Not allowed to update this booking");
    }

    const isOwner = order.user_id === userId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException("Not allowed to update this booking");
    }

    // Delete existing items from order_items to avoid douplicates
    await supabase.from("order_items").delete().eq("order_id", orderId);

    for (const item of updatedItems) {
      const start = new Date(item.start_date);
      const end = new Date(item.end_date);
      const totalDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      const { data: storageItem } = await supabase
        .from("storage_items")
        .select("location_id")
        .eq("id", item.item_id)
        .single();

      if (!storageItem) {
        throw new Error("Storage item not found");
      }

      await supabase.from("order_items").insert({
        order_id: orderId,
        item_id: item.item_id,
        location_id: storageItem.location_id,
        quantity: item.quantity,
        start_date: item.start_date,
        end_date: item.end_date,
        total_days: totalDays,
        status: "pending",
      });
    }

    return { message: "Booking updated" };
  }

  // 6. reject a Booking (Admin/SuperVera only)
  async rejectBooking(orderId: string, userId: string) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    const { data: user } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!user || (user.role !== "admin" && user.role !== "superVera")) {
      throw new ForbiddenException("Only admins can reject bookings");
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: "rejected" })
      .eq("id", orderId);

    if (error) {
      throw new BadRequestException("Could not reject the booking");
    }

    return { message: "Booking rejected" };
  }

  // 7. cancel a Booking (User if not confirmed, Admins/SuperVera always)
  async cancelBooking(orderId: string, userId: string) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    const { data: order } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .single<{
        user_id: string;
        status: string;
      }>();

    if (!order) throw new BadRequestException("Order not found");

    const { data: userProfile, error: userProfileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (userProfileError || !userProfile) {
      throw new BadRequestException("User profile not found");
    }

    const isAdmin =
      userProfile.role === "admin" || userProfile.role === "superVera";
    const isOwner = order.user_id === userId;

    if (!isAdmin) {
      if (!isOwner) {
        throw new ForbiddenException("You can only cancel your own bookings");
      }
      if (order.status === "confirmed") {
        throw new ForbiddenException(
          "You can't cancel a booking that has already been confirmed",
        );
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: isAdmin ? "cancelled by admin" : "cancelled by user" })
      .eq("id", orderId);

    if (error) {
      throw new BadRequestException("Could not cancel the booking");
    }

    return {
      message: `Booking cancelled by ${isAdmin ? "admin" : "user"}`,
    };
  }

  // 8. delete a Booking and mark it as deleted
  async deleteBooking(orderId: string, userId: string) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    // check if order is in database
    const { data: order } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .single();

    if (!order) throw new BadRequestException("Order not found");

    const { data: userProfile, error: userProfileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (userProfileError || !userProfile) {
      throw new BadRequestException("User profile not found");
    }

    const isAdmin =
      userProfile.role === "admin" || userProfile.role === "superVera";

    if (!isAdmin) {
      throw new ForbiddenException(
        "You are not allowed to delete this booking",
      );
    }

    // Delete all items
    await supabase.from("order_items").delete().eq("order_id", orderId);

    // Mark order as deleted
    await supabase
      .from("orders")
      .update({ status: "deleted" })
      .eq("id", orderId);

    return { message: "Booking deleted" };
  }

  // 9. return items (when items are brought back)
  async returnItems(orderId: string, userId: string) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    const { data: items } = await supabase
      .from("order_items")
      .select("item_id, quantity")
      .eq("order_id", orderId);

    if (!items || items.length === 0) {
      throw new BadRequestException("No items found for return");
    }

    for (const item of items) {
      await supabase.rpc("increment_item_quantity", {
        item_id: item.item_id,
        quantity: item.quantity,
      });
    }

    return { message: "Items returned successfully" };
  }

  // 10. check availability of item by date range
  async checkAvailability(
    itemId: string,
    startDate: string,
    endDate: string,
    userId: string,
  ) {
    const supabase = await this.supabaseService.getClientByRole(userId);

    // Sum all overlapping bookings
    const { data: overlappingOrders, error: overlapError } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("item_id", itemId)
      .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

    if (overlapError) {
      throw new BadRequestException("Error checking overlapping bookings");
    }

    const alreadyBookedQuantity =
      overlappingOrders?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ??
      0;

    // Get total quantity of item from storage
    const { data: itemData, error: itemError } = await supabase
      .from("storage_items")
      .select("items_number_total")
      .eq("id", itemId)
      .single();

    if (itemError || !itemData) {
      throw new BadRequestException("Item data not found");
    }

    const availableQuantity =
      itemData.items_number_total - alreadyBookedQuantity;

    return {
      item_id: itemId,
      availableQuantity,
      alreadyBookedQuantity,
      totalQuantity: itemData.items_number_total,
      startDate,
      endDate,
    };
  }
}
// This service handles the logic for creating, confirming, rejecting, and cancelling bookings.
