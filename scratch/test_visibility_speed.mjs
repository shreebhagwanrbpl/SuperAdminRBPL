const start = Date.now();

try {
  const res = await fetch("http://localhost:3000/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "updateVisibility",
      companyId: "rajbiosis",
      targetType: "bulk_products",
      targetWebsites: ["rajbiosis.com", "rbplbiomedical.com"],
      productIds: [
        "f42b6625-b523-479c-bf9a-df947be0b40f",
        "b1b68835-3ab7-482d-b36d-05e7aaab1dc6"
      ]
    })
  });

  const duration = Date.now() - start;
  const data = await res.json();
  console.log(`HTTP status: ${res.status}`);
  console.log(`Response time: ${duration}ms`);
  console.log("Result:", data);
} catch (err) {
  console.error("Test failed:", err);
}
