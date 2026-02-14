import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderInterests, surveys } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const body = await req.json();
  const { participantId, email, imageIds, type } = body;

  if (!participantId || !email || !imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    return NextResponse.json(
      { error: "participantId, email, and imageIds are required" },
      { status: 400 }
    );
  }

  const id = uuid();
  await db.insert(orderInterests).values({
    id,
    surveyId,
    participantId,
    email,
    imageIds: JSON.stringify(imageIds),
    createdAt: new Date().toISOString(),
  });

  // Look up survey title for the email
  const survey = await db.query.surveys.findFirst({
    where: eq(surveys.id, surveyId),
  });
  const surveyTitle = survey?.title ?? "ImageVote survey";

  const adminEmail = process.env.ADMIN_EMAIL;

  // Send notification to admin
  if (adminEmail) {
    try {
      await getResend().emails.send({
        from: "Dormy <hello@guidal.org>",
        to: adminEmail,
        replyTo: email,
        subject: `New ${type === "preorder" ? "pre-order" : "beta tester"} sign-up: ${email}`,
        html: `
          <h2>New ${type === "preorder" ? "Pre-order" : "Beta Tester"} Interest</h2>
          <p><strong>Type:</strong> ${type === "preorder" ? "Pre-order" : "Beta list"}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Survey:</strong> ${surveyTitle}</p>
          <p><strong>Images selected:</strong> ${imageIds.length}</p>
          <p><strong>Image IDs:</strong> ${imageIds.join(", ")}</p>
          <p><em>Reply to this email to contact them directly.</em></p>
        `,
      });
    } catch (err) {
      console.error("Failed to send admin notification:", err);
    }
  }

  // Send confirmation to participant
  try {
    await getResend().emails.send({
      from: "Dormy <hello@guidal.org>",
      to: email,
      replyTo: adminEmail || "mwpicard@gmail.com",
      subject: type === "preorder"
        ? "Your Dormy pre-order is confirmed!"
        : "You're on the Dormy Beta tester list!",
      html: type === "preorder"
        ? `<h2>Pre-order confirmed!</h2><p>Thanks for your pre-order — we'll be in touch soon.</p><p>If you have any questions, just reply to this email.</p>`
        : `<h2>Welcome to the Dormy Beta list!</h2><p>Thanks for signing up — we'll be in touch soon with updates on how to get one of the very first Dormy.</p><p>If you have any questions, just reply to this email.</p>`,
    });
  } catch (err) {
    console.error("Failed to send confirmation email:", err);
  }

  return NextResponse.json({ id }, { status: 201 });
}
