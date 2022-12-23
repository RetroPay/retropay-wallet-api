import { v2 as cloudinary } from 'cloudinary'
import IcloudinaryResponse from "@/utils/interfaces/cloudinaryResponse.interface"


const cloudinaryUpload = async (file: any): Promise<any | Error > => {
	try {
		cloudinary.config({
			cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
			api_key: process.env.CLOUDINARY_API_KEY,
			api_secret: process.env.CLOUDINARY_API_SECRET,
			secure: true,
		});
		const result: any = await cloudinary.uploader.upload(file)
		return result
	} catch (error: any) {
		return error
	}
};

export default cloudinaryUpload;
