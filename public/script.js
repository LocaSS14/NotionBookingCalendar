// Replace with your actual Netlify function endpoint
// e.g. "https://your-site.netlify.app/.netlify/functions/book-appointment"
const NETLIFY_FUNCTION_URL = "https://app.netlify.com/sites/kaleidoscopic-valkyrie-450c6a";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("booking-form");
  const resultEl = document.getElementById("result-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // prevent page reload

    // Grab values from the form
    const dateValue = document.getElementById("appointment-date").value;  // "YYYY-MM-DD"
    const timeValue = document.getElementById("time-slot").value;        // "HH:MM" (24-hr)
    const nameValue = document.getElementById("name").value.trim();
    const emailValue = document.getElementById("email").value.trim();
    const phoneValue = document.getElementById("phone").value.trim();

    // Simple validation
    if (!dateValue || !timeValue || !nameValue || !emailValue || !phoneValue) {
      resultEl.style.color = "red";
      resultEl.textContent = "Please fill out all required fields.";
      return;
    }

    // Construct full date/time in ISO format: "YYYY-MM-DDTHH:MM:00"
    // This is local time, so keep in mind any time zone difference in your server logic
    const dateTime = `${dateValue}T${timeValue}:00`;

    // Build the payload to send
    const payload = {
      name: nameValue,
      email: emailValue,
      phone: phoneValue,
      dateTime: dateTime,
    };

    // Clear previous message
    resultEl.textContent = "";
    resultEl.style.color = "black";

    try {
      // Send POST request to Netlify function
      const response = await fetch(NETLIFY_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // success
        resultEl.style.color = "green";
        resultEl.textContent = "Appointment booked successfully!";
        form.reset();
      } else {
        // handle errors
        resultEl.style.color = "red";
        if (response.status === 409) {
          // Slot conflict from the server
          resultEl.textContent = "This slot is already booked. Please choose another.";
        } else {
          // Other server errors
          resultEl.textContent = data.error || "Something went wrong!";
        }
      }
    } catch (error) {
      console.error("Error during fetch:", error);
      resultEl.style.color = "red";
      resultEl.textContent = "Network or server error. Please try again later.";
    }
  });
});
