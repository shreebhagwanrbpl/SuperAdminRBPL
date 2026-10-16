import { createTimestampObject } from "../lib/clientDb.js";

const res = await fetch("http://localhost:3000/api/db?op=collection&path=websitesQueries%2Findiandiagnosticscom%2FcontactQueries&order=%5B%7B%22field%22%3A%22createdAt%22%2C%22direction%22%3A%22desc%22%7D%5D");
const json = await res.json();
console.log(`Fetched ${json.docs?.length || 0} contact queries:`);
for (const doc of (json.docs || [])) {
  const data = doc.data;
  const ts = createTimestampObject(data.createdAt);
  console.log("-----------------------------------------");
  console.log("ID:", doc.id);
  console.log("Name:", data.name);
  console.log("createdAt raw:", data.createdAt);
  console.log("toDate():", ts?.toDate ? ts.toDate() : "NO toDate");
  console.log("toDate().toLocaleString():", ts?.toDate ? ts.toDate().toLocaleString("en-IN") : "-");
  console.log("seconds:", ts?.seconds);
}

const resProd = await fetch("http://localhost:3000/api/db?op=collection&path=websitesQueries%2Findiandiagnosticscom%2FproductQueries&order=%5B%7B%22field%22%3A%22createdAt%22%2C%22direction%22%3A%22desc%22%7D%5D");
const jsonProd = await resProd.json();
console.log(`\nFetched ${jsonProd.docs?.length || 0} product queries:`);
for (const doc of (jsonProd.docs || [])) {
  const data = doc.data;
  const ts = createTimestampObject(data.createdAt);
  console.log("-----------------------------------------");
  console.log("ID:", doc.id);
  console.log("Product:", data.productName || data.name);
  console.log("createdAt raw:", data.createdAt);
  console.log("toDate():", ts?.toDate ? ts.toDate() : "NO toDate");
  console.log("toDate().toLocaleString():", ts?.toDate ? ts.toDate().toLocaleString("en-IN") : "-");
}
