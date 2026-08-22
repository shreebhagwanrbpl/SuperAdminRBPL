// import { GoogleGenAI } from "@google/genai";
// import { db } from "@/lib/firebase";
// import { doc, getDoc } from "firebase/firestore";

// export async function POST(req) {
//     try {
//         const { question } = await req.json();

//         const WEBSITE = "globalbiomedicalsin";

//         // Products document load
//         const productsRef = doc(
//             db,
//             "websites",
//             WEBSITE,
//             "pages",
//             "products"
//         );

//         const productsSnap = await getDoc(productsRef);

//         let products = [];

//         if (productsSnap.exists()) {
//             const data = productsSnap.data();

//             products = data.products || [];
//         }

//         const prompt = `
// You are the official AI assistant of ${WEBSITE}.

// IMPORTANT RULES:

// 1. Answer ONLY from the product information provided below.
// 2. Do NOT use your own knowledge.
// 3. Do NOT answer unrelated questions.
// 4. If answer is not found say:
//    "Please contact our team for more information."

// PRODUCT DATA:

// ${JSON.stringify(products)}

// CUSTOMER QUESTION:

// ${question}
// `;

//         const ai = new GoogleGenAI({
//             apiKey: process.env.GEMINI_API_KEY,
//         });

//         const response = await ai.models.generateContent({
//             model: "gemini-2.5-flash",
//             contents: prompt,
//         });

//         return Response.json({
//             success: true,
//             answer: response.text,
//         });

//     } catch (error) {
//         console.error(error);

//         return Response.json({
//             success: false,
//             error: error.message,
//         });
//     }
// }