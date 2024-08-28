import { useMutation } from "react-query";
import ManageHotelForm from "../forms/MangeHotelForm/ManageHotelForm";
import { useAppContext } from "../contexts/AppContext";
import * as apiClient from "../api-client.ts"
const AddHotel=()=>{
    const {showToast}=useAppContext();
    const {mutate,isLoading}=useMutation(apiClient.addMyHotel,{
        onSuccess:()=>{
            showToast({message:"Hotel Details Saved!",type:"SUCCESS"})
        },onError:()=>{
            showToast({message:"Error saving hotel",type:"ERROR"})
        }
    });
    const handleSave=(hotelFormData:FormData)=>{
        mutate(hotelFormData)
    }
    return <ManageHotelForm onSave={handleSave} isLoading={isLoading} / >;
}
export default AddHotel;