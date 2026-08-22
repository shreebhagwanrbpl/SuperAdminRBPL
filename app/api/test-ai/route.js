// import { GoogleGenAI } from "@google/genai";

// export async function GET() {
//     try {
//         const ai = new GoogleGenAI({
//             apiKey: process.env.GEMINI_API_KEY,
//         });

//         const response = await ai.models.generateContent({
//             model: "gemini-2.5-flash",
//             contents: "Hello",
//         });

//         return Response.json({
//             success: true,
//             answer: response.text,
//         });
//     } catch (error) {
//         return Response.json({
//             success: false,
//             error: error.message,
//         });
//     }
// }