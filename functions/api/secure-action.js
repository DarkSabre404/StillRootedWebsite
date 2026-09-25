export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // Access secure environment variables set in Cloudflare dashboard
    // Example: const apiKey = env.MY_SECRET_API_KEY;

    // Perform secure server-side logic here
    // Since this runs on Cloudflare's edge workers, the user never sees this code or keys.

    return new Response(JSON.stringify({ success: true, message: "Secure action processed successfully!" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid request or unauthorized" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}