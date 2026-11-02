async function main() {
  const response = await fetch("http://localhost:3001/api/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      business_name: "LeadPulse Test Hotel",
      category: "Hotel",
      phone: "+977-9800000000",
      email: "test@example.com",
      website: "https://example.com",
      address: "Kathmandu, Nepal",
      city: "Kathmandu",
      country: "Nepal",
      source: "manual_test"
    })
  });

  const data = await response.json();

  console.log("HTTP status:", response.status);
  console.log(JSON.stringify(data, null, 2));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});