# File Uploads

## With zod-form-data

Use `zod-form-data` to validate `FormData` containing files:

```bash
npm install zod-form-data
```

> **Note:** Verify zod-form-data compatibility with your Zod version (especially if using Zod v4).

### Action Definition

```ts
// src/app/actions.ts
"use server";

import { zfd } from "zod-form-data";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";

export const uploadAvatar = actionClient
  .inputSchema(
    zfd.formData({
      file: zfd.file(
        z.instanceof(File)
          .refine((f) => f.size < 5_000_000, "File must be under 5MB")
          .refine(
            (f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type),
            "Only JPEG, PNG, and WebP images are allowed"
          )
      ),
      alt: zfd.text(z.string().min(1).optional()),
    })
  )
  .action(async ({ parsedInput: { file, alt } }) => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToStorage(buffer, file.name);
    return { url, alt };
  });
```

### Client Component

```tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { uploadAvatar } from "@/app/actions";

export function AvatarUpload() {
  const { execute, result, isPending } = useAction(uploadAvatar);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        execute(formData); // Pass FormData directly
      }}
    >
      <input name="file" type="file" accept="image/*" required />
      <input name="alt" placeholder="Alt text" />
      <button type="submit" disabled={isPending}>
        {isPending ? "Uploading..." : "Upload"}
      </button>
      {result.data && <img src={result.data.url} alt={result.data.alt} />}
      {result.validationErrors?.file?._errors && (
        <p className="text-red-500">{result.validationErrors.file._errors[0]}</p>
      )}
    </form>
  );
}
```

## With Bind Arguments + File Upload

Combine file uploads with bound arguments (e.g., a resource ID):

```ts
// Action
export const uploadPostImage = authActionClient
  .bindArgsSchemas([z.string().uuid()]) // postId
  .inputSchema(
    zfd.formData({
      image: zfd.file(z.instanceof(File)),
      caption: zfd.text(z.string().optional()),
    })
  )
  .action(async ({ parsedInput, bindArgsParsedInputs: [postId] }) => {
    const buffer = Buffer.from(await parsedInput.image.arrayBuffer());
    const url = await uploadToStorage(buffer, parsedInput.image.name);
    await db.postImage.create({ postId, url, caption: parsedInput.caption });
    return { url };
  });
```

```tsx
// Component
const boundUpload = uploadPostImage.bind(null, post.id);
const { execute } = useAction(boundUpload);

const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  execute(new FormData(e.currentTarget));
};
```

## Multiple File Upload

```ts
export const uploadFiles = actionClient
  .inputSchema(
    zfd.formData({
      files: zfd.repeatableOfType(
        zfd.file(z.instanceof(File).refine((f) => f.size < 10_000_000))
      ),
    })
  )
  .action(async ({ parsedInput: { files } }) => {
    const urls = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return uploadToStorage(buffer, file.name);
      })
    );
    return { urls };
  });
```
