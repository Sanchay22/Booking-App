import { useQuery } from "react-query";
import * as apiClient from "../api-client";
import BookingForm from "../forms/BookingForm/BookingForm";
import { useSearchContext } from "../contexts/SearchContext";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import BookingDetailsSummary from "../components/BookingDetailsSummary";
const Booking = () => {
  const search = useSearchContext();
  const { hotelId } = useParams();

  const [numberOfNights, setNumberOfNights] = useState<number>(0);

  useEffect(() => {
    if (search.checkIn && search.checkOut) {
      const nights =
        Math.abs(search.checkOut.getTime() - search.checkIn.getTime()) /
        (1000 * 60 * 60 * 24);

      setNumberOfNights(Math.ceil(nights));
    }
  }, [search.checkIn, search.checkOut]);
  const {
    data: paymentIntentData,
    isLoading: isPaymentLoading,
    isError: isPaymentError,
  } = useQuery(
    "createPayPalOrder",
    () =>
      apiClient.createPayPalOrder(
        hotelId as string,
        numberOfNights.toString()
      ),
    {
      enabled: !!hotelId && numberOfNights > 0,
    }
  );
  const { data: hotel, isLoading: isHotelLoading, isError: isHotelError } = useQuery(
    "fetchHotelByID",
    () => apiClient.fetchHotelById(hotelId as string),
    {
      enabled: !!hotelId,
    }
  );
  const { data: currentUser, isLoading: isUserLoading, isError: isUserError } = useQuery(
    "fetchCurrentUser",
    apiClient.fetchCurrentUser
  );
  if (isHotelLoading || isPaymentLoading || isUserLoading) {
    return <div>Loading...</div>;
  }

  if (isHotelError || isPaymentError || isUserError) {
    return <div>Error loading data</div>;
  }
  if (!hotel || !paymentIntentData || !currentUser) {
    return <div>Required data is missing</div>;
  }

  return (
    <div className="grid md:grid-cols-[1fr_2fr] gap-5">
      <BookingDetailsSummary
        checkIn={search.checkIn}
        checkOut={search.checkOut}
        adultCount={search.adultCount}
        childCount={search.childCount}
        numberOfNights={numberOfNights}
        hotel={hotel}
      />
      <BookingForm
        currentUser={currentUser}
        paymentIntent={paymentIntentData}
      />
    </div>
  );
};

export default Booking;
