import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";


const s3 = new S3Client({ region: process.env.AWS_REGION });


export async function POST(req: Request) {
try {
const { fileName, fileType } = await req.json();
if (!fileName || !fileType) return new Response("Bad request", { status: 400 });


const key = `receipts/${randomUUID()}-${fileName}`;


const command = new PutObjectCommand({
Bucket: process.env.S3_BUCKET!,
Key: key,
ContentType: fileType,
// ACL not needed (private by default). We'll keep files private.
});


const url = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60s expiry


return Response.json({ url, key });
} catch (e) {
console.error("[UPLOAD_URL_ERROR]", e);
return new Response("Failed to create signed URL", { status: 500 });
}
}