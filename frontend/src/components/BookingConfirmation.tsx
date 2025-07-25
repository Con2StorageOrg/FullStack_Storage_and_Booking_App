import React from "react";
import { useAppSelector } from "../store/hooks";
import {
  selectCurrentBooking,
  selectBookingLoading,
} from "../store/slices/bookingsSlice";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/translations";

const BookingConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const booking = useAppSelector(selectCurrentBooking);
  const isLoading = useAppSelector(selectBookingLoading);

  // Add language support
  const { lang } = useLanguage();

  return (
    <div className="container mx-auto p-8 max-w-md">
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold mb-4">
          {t.bookingConfirmation.title[lang]}
        </h2>
        <p className="mb-4">{t.bookingConfirmation.message[lang]}</p>
        {isLoading ? (
          <div className="bg-slate-50 p-4 rounded-md flex justify-center items-center mb-6 h-12">
            <LoaderCircle className="animate-spin h-5 w-5 mr-2" />
            <span className="text-sm text-gray-600">
              {t.bookingConfirmation.loading[lang]}
            </span>
          </div>
        ) : booking ? (
          <div className="bg-slate-50 p-4 rounded-md text-left mb-6">
            <p>
              <span className="font-semibold">
                {t.bookingConfirmation.bookingNumber[lang]}
              </span>{" "}
              {booking.booking_number}
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 p-4 rounded-md text-left mb-6 text-amber-600">
            <p>{t.bookingConfirmation.notAvailable[lang]}</p>
          </div>
        )}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => navigate("/profile?tab=bookings")}
            className="flex-1 bg-background text-secondary border-secondary border hover:bg-secondary hover:text-white"
          >
            {t.bookingConfirmation.buttons.viewBookings[lang]}
          </Button>
          <Button
            onClick={() => navigate("/storage")}
            className="flex-1 bg-background text-primary border-primary border hover:bg-primary hover:text-white"
          >
            {t.bookingConfirmation.buttons.continueBrowsing[lang]}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
