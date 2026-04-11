// Auth is now handled by Firebase + iron-session.
// Actual endpoints: /api/auth/signin, /api/auth/signout, /api/auth/me
export async function GET() {
  return new Response("Not found", { status: 404 });
}
export async function POST() {
  return new Response("Not found", { status: 404 });
}
