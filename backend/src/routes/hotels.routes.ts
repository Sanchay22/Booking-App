import express, { Request,Response } from "express";
import Hotel from "../models/hotel.models";
import paypal from '@paypal/checkout-server-sdk'
import { BookingType, HotelSearchResponse } from "../shared/types";
import { param, validationResult } from "express-validator";
import verifyToken from "../middleware/auth.middleware";
import { client } from "../middleware/paypal.middleware";
const router=express.Router();

router.post(
  "/:hotelId/bookings/create-order",
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const hotelId = req.params.hotelId;
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(400).json({ message: "Hotel not found" });
    }

    const totalCost = hotel.pricePerNight * numberOfNights;
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: totalCost.toFixed(2),
          },
          custom_id: hotelId,
        },
      ],
      application_context:{
        shipping_preference:"NO_SHIPPING"
      }
    });

    try {
      const order = await client().execute(request);
      res.status(200).json({
        orderId: order.result.id,
        totalCost,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error creating PayPal order' });
    }
  }
);

router.post('/capture-order/:orderId', async (req:Request, res:Response) => {
  const request = new paypal.orders.OrdersCaptureRequest(req.params.orderId);
  try {
    const capture = await client().execute(request);
    res.json(capture.result);
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    res.status(500).send('Error capturing order');
  }
});

router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.body;
      const hotelId = req.params.hotelId;
      const request = new paypal.orders.OrdersGetRequest(orderId);
      const order = await client().execute(request);
      console.log("sab theek")
      if (!order) {
        return res.status(400).json({ message: "Order not found" });
      }
      const hotelIdInOrder = order.result.purchase_units[0].custom_id;
      if (hotelIdInOrder !== hotelId) {
        return res.status(400).json({ message: "Order mismatch" });
      }
      if (order.result.status !== 'COMPLETED') {
        return res.status(400).json({
          message: `Order not completed. Status: ${order.result.status}`,
        });
      }
      const newBooking: BookingType = {
        ...req.body,
        userId: req.userId,
      };

      const hotel = await Hotel.findOneAndUpdate(
        { _id: hotelId },
        {
          $push: { bookings: newBooking },
        }
      );

      if (!hotel) {
        return res.status(400).json({ message: "Hotel not found" });
      }
      await hotel.save();
      res.status(200).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);


router.get("/search",async (req:Request, res:Response)=>{
    try {
        const query=constructSearchQuery(req.query);
        let sortOptions = {};
    switch (req.query.sortOption) {
      case "starRating":
        sortOptions = { starRating: -1 };
        break;
      case "pricePerNightAsc":
        sortOptions = { pricePerNight: 1 };
        break;
      case "pricePerNightDesc":
        sortOptions = { pricePerNight: -1 };
        break;
    }
        const pageSize=5;
        const pageNumber=parseInt(
            req.query.page ?req.query.page.toString():"1"
        );
        const skip=(pageNumber-1)* pageSize;
        const hotels =await Hotel.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize);
        const total =await Hotel.countDocuments(query);
        const response:HotelSearchResponse={
            data:hotels,
            pagination:{
                total,
                page:pageNumber,
                pages:Math.ceil(total/pageSize)
            },
        }; 
        res.json(response);
        

    } catch (error) {
        res.status(500).json({message:"Something went wrong"});
    }
})

router.get("/:id",[
  param("id").notEmpty().withMessage("Hotel Id is required")
]
  ,async(req:Request,res:Response)=>{
    const errors=validationResult(req);
    if(!errors.isEmpty()){
      return res.status(400).json({errors:errors.array()});
    }
    const id=req.params.id.toString();
    try {
      const hotel=await Hotel.findById(id);
      res.json(hotel);
    } catch (error) {
      res.status(500).json({message:"Error fetching hotel "})
    }
})

const constructSearchQuery = (queryParams: any) => {
    let constructedQuery: any = {};
  
    if (queryParams.destination) {
      constructedQuery.$or = [
        { city: new RegExp(queryParams.destination, "i") },
        { country: new RegExp(queryParams.destination, "i") },
      ];
    }
  
    if (queryParams.adultCount) {
      constructedQuery.adultCount = {
        $gte: parseInt(queryParams.adultCount),
      };
    }
  
    if (queryParams.childCount) {
      constructedQuery.childCount = {
        $gte: parseInt(queryParams.childCount),
      };
    }
  
    if (queryParams.facilities) {
      constructedQuery.facilities = {
        $all: Array.isArray(queryParams.facilities)
          ? queryParams.facilities
          : [queryParams.facilities],
      };
    }
  
    if (queryParams.types) {
      constructedQuery.type = {
        $in: Array.isArray(queryParams.types)
          ? queryParams.types
          : [queryParams.types],
      };
    }
  
    if (queryParams.stars) {
      const starRatings = Array.isArray(queryParams.stars)
        ? queryParams.stars.map((star: string) => parseInt(star))
        : parseInt(queryParams.stars);
  
      constructedQuery.starRating = { $in: starRatings };
    }
  
    if (queryParams.maxPrice) {
      constructedQuery.pricePerNight = {
        $lte: parseInt(queryParams.maxPrice).toString(),
      };
    }
  
    return constructedQuery;
  };
export default router;
