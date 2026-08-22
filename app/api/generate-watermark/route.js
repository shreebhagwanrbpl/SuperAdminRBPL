// import { NextResponse } from "next/server";
// import { addWatermark } from "@/lib/watermark";
// import { storage } from "@/lib/firebase";
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// export async function POST(req) {
//   try {
//     const body = await req.json();
//     const { imageUrl, imageBase64, website, filename: customFilename } = body;

//     if (!website) {
//       return NextResponse.json(
//         { success: false, error: "Website is required" },
//         { status: 400 }
//       );
//     }

//     let inputBuffer;

//     if (imageBase64) {
//       // Decode base64 image
//       const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
//       inputBuffer = Buffer.from(base64Data, "base64");
//     } else if (imageUrl) {
//       // Fetch image from URL with 6s timeout
//       const controller = new AbortController();
//       const timeoutId = setTimeout(() => controller.abort(), 6000);
//       try {
//         const response = await fetch(imageUrl, { signal: controller.signal });
//         clearTimeout(timeoutId);
//         if (!response.ok) {
//           throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
//         }
//         const arrayBuffer = await response.arrayBuffer();
//         inputBuffer = Buffer.from(arrayBuffer);
//       } catch (err) {
//         clearTimeout(timeoutId);
//         throw err;
//       }
//     } else {
//       return NextResponse.json(
//         { success: false, error: "Either imageUrl or imageBase64 is required" },
//         { status: 400 }
//       );
//     }

//     // Apply watermark for the specified website (resized to 800px max, quality 80)
//     const outputBuffer = await addWatermark(inputBuffer, website);

//     // Save directly to Firebase Storage on server (zero base64 payload to client)
//     const filename = customFilename || `${Date.now()}_${Math.random().toString(36).substring(7)}_wm.jpg`;
//     const storageRef = ref(storage, `watermarked_products/${website}/${filename}`);
    
//     await uploadBytes(storageRef, outputBuffer, { contentType: "image/jpeg" });
//     const downloadUrl = await getDownloadURL(storageRef);

//     return NextResponse.json({
//       success: true,
//       website,
//       watermarkedImage: downloadUrl,
//     });
//   } catch (error) {
//     console.error("Error in /api/generate-watermark:", error);
//     return NextResponse.json(
//       { success: false, error: error.message || "Watermark generation failed" },
//       { status: 500 }
//     );
//   }
// }
