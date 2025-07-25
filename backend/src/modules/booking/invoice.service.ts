import { SupabaseService } from "../supabase/supabase.service";
import { BadRequestException, Injectable } from "@nestjs/common";
import {
  generateFinnishReferenceNumber,
  generateVirtualBarcode,
  generateBarcodeImage,
  generateInvoicePDF,
} from "../../utils/invoice-functions";
import { PostgrestResponse } from "@supabase/supabase-js";
import { BookingsRow, UserProfilesRow } from "./types/booking.interface";

@Injectable()
export class InvoiceService {
  constructor(private readonly supabaseService: SupabaseService) {} // TODO refactor

  async generateInvoice(bookingId: string): Promise<string> {
    const supabase = this.supabaseService.getServiceClient();

    // Load booking
    const {
      data: booking,
      error: bookingError,
    }: PostgrestResponse<BookingsRow> = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (!booking || bookingError) {
      throw new BadRequestException("Booking not found");
    }

    // Load related booking items
    const { data: bookingItems, error: itemsError } = await supabase
      .from("booking_items")
      .select("*, storage_items(*)") // only works if storage_items is a foreign key
      .eq("booking_id", bookingId);
    if (!bookingItems || itemsError) {
      throw new BadRequestException("Booking items not found");
    }

    // Load user
    const { data: user, error: userError }: PostgrestResponse<UserProfilesRow> =
      await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", booking[0].user_id)
        .single();
    if (!user || userError) {
      throw new BadRequestException("User not found");
    }

    // Generate invoice number + Viitenumero
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(
      Math.random() * 10000, // different logic for invoice number generation
    )
      .toString()
      .padStart(4, "0")}`;
    const referenceNumber = generateFinnishReferenceNumber(invoiceNumber); // custom helper function
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    // Calculate price (dummy values here, dynamic later) // TODO: use real values
    const subtotal = 100; // e.g. from the item prices
    const vatRate = 0.24;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    // Generate barcode (e.g. via bwip-js) // TODO: use bwip-js
    const barcodeString = generateVirtualBarcode({
      iban: "FI2112345600000785",
      amount: total,
      reference: referenceNumber,
      dueDate,
    });
    const barcodeImage = await generateBarcodeImage(barcodeString); // Buffer or Base64

    // Generate PDF with pdfkit
    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber,
      user: user,
      items: bookingItems,
      total,
      vatAmount,
      barcodeImage,
      referenceNumber,
      dueDate,
    });

    // Upload to Supabase Storage or store URL
    const filePath = `invoices/${invoiceNumber}.pdf`;
    await supabase.storage.from("invoices").upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
    });

    /*     await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      booking_id: booking.id,
      user_id: booking.user_id,
      reference_number: referenceNumber,
      total_amount: total,
      due_date: dueDate.toISOString().split("T")[0],
      pdf_url: filePath,
    }); */

    const { data: publicUrlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }
}
