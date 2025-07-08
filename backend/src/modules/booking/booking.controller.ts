import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Post,
  Put,
  Req,
  Patch,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { BookingService } from "./booking.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdatePaymentStatusDto } from "./dto/update-payment-status.dto";
import { AuthRequest } from "src/middleware/interfaces/auth-request.interface";
import {
  BookingItem,
  BookingStatus,
  ValidBookingOrder,
} from "./types/booking.interface";

@Controller("bookings")
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // gets all bookings - use case: admin
  @Get()
  async getAll(
    @Req() req: AuthRequest,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const supabase = req.supabase;
    return this.bookingService.getAllBookings(
      supabase,
      pageNumber,
      limitNumber,
    );
  }

  // gets the bookings of the logged-in user
  @Get("my")
  async getOwnBookings(
    @Req() req: AuthRequest,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.getUserBookings(
      userId,
      supabase,
      pageNumber,
      limitNumber,
    );
  }

  // gets the bookings of a specific user
  @Get("user/:userId")
  async getUserBookings(
    @Param("userId") userId: string,
    @Req() req: AuthRequest,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    if (!userId) {
      throw new UnauthorizedException("User ID is required");
    }
    const supabase = req.supabase;
    return this.bookingService.getUserBookings(
      userId,
      supabase,
      pageNumber,
      limitNumber,
    );
  }

  // any user creates a booking
  @Post()
  async createBooking(@Body() dto: CreateBookingDto, @Req() req: AuthRequest) {
    try {
      const userId = req.user.id;
      if (!userId)
        throw new BadRequestException("No userId found: user_id is required");

      // put user-ID to DTO
      const dtoWithUserId = { ...dto, user_id: userId };
      return this.bookingService.createBooking(dtoWithUserId, req.supabase);
    } catch (error) {
      console.error("Booking creation failed:", error);

      // Return a structured error but avoid 500
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        "There was an issue processing your booking. If this persists, please contact support.",
      );
    }
  }

  // confirms a booking
  @Put(":id/confirm") // admin confirms booking
  async confirm(@Param("id") orderId: string, @Req() req: AuthRequest) {
    const userId = req.user.id;
    const supabase = req.supabase;

    return this.bookingService.confirmBooking(orderId, userId, supabase);
  }

  // updates a booking
  @Put(":id/update") // user updates own booking or admin updates booking
  async updateBooking(
    @Param("id") id: string,
    @Body("items") updatedItems: BookingItem[],
    @Req() req: AuthRequest,
  ) {
    const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.updateBooking(
      id,
      userId,
      updatedItems,
      supabase,
    );
  }

  // rejects a booking by admin
  @Put(":id/reject")
  async reject(@Param("id") id: string, @Req() req: AuthRequest) {
    const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.rejectBooking(id, userId, supabase);
  }

  // cancels own booking by user or admin cancels any booking
  @Delete(":id/cancel")
  async cancel(@Param("id") id: string, @Req() req: AuthRequest) {
    const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.cancelBooking(id, userId, supabase);
  }

  // admin deletes booking
  @Delete(":id/delete")
  async delete(@Param("id") id: string, @Req() req: AuthRequest) {
    const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.deleteBooking(id, userId, supabase);
  }

  // admin returns items
  @Post(":id/return")
  async returnItems(@Param("id") id: string, @Req() req: AuthRequest) {
    const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.returnItems(id, userId, supabase);
  }

  // admin marks items as picked up
  @Post(":orderId/pickup")
  async pickup(@Param("orderId") orderId: string, @Req() req: AuthRequest) {
    // const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.confirmPickup(orderId, supabase);
  }

  // change payment status
  @Patch("payment-status")
  async updatePaymentStatus(
    @Body() dto: UpdatePaymentStatusDto,
    @Req() req: AuthRequest,
  ) {
    // const userId = req.user.id;
    const supabase = req.supabase;
    return this.bookingService.updatePaymentStatus(
      dto.orderId,
      dto.status,
      supabase,
    );
  }

  @Get("ordered")
  getOrderedBookings(
    @Req() req: AuthRequest,
    @Query("search") searchquery: string,
    @Query("order") ordered_by: ValidBookingOrder = "order_number",
    @Query("status") status_filter: BookingStatus,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("ascending") ascending: string = "true",
  ) {
    const supabase = req.supabase;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const is_ascending = ascending.toLowerCase() === "true";
    return this.bookingService.getOrderedBookings(
      supabase,
      pageNum,
      limitNum,
      is_ascending,
      ordered_by,
      searchquery,
      status_filter,
    );
  }
  // commented out because it is not used atm
  /* @Get(":orderId/generate") // unsafe - anyone can create files
  async generateInvoice(@Param("orderId") orderId: string) {
    const url = await this.invoiceService.generateInvoice(orderId);

    return url; // should not send url, becaause it is not a public url - will get new endpoint with auth and so on...
  } */
}
// handles the booking process, including creating, confirming, rejecting, and canceling bookings.
