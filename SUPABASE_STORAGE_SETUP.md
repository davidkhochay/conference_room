# 📦 Supabase Storage Setup for Image Uploads

## 🎯 What This Does

Enables direct image uploads for conference room photos instead of requiring URLs.

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Create Storage Bucket

1. Go to your Supabase dashboard:
   https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea

2. Click **Storage** in the left sidebar

3. Click **"New bucket"** button

4. Fill in:
   - **Name**: `room-photos`
   - **Public bucket**: ✅ **Check this box** (so images are publicly accessible)
   - **File size limit**: 5 MB (or leave default)

5. Click **"Create bucket"**

### Step 2: Set Storage Policies

1. Click on the **"room-photos"** bucket you just created

2. Go to **"Policies"** tab

3. Click **"New Policy"**

4. Create two policies:

#### Policy 1: Public Read Access

```sql
-- Name: Public Read Access
-- Operation: SELECT

CREATE POLICY "Public can view room photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'room-photos');
```

#### Policy 2: Authenticated Upload

```sql
-- Name: Authenticated Upload
-- Operation: INSERT

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'room-photos');
```

#### Policy 3: Service Role Full Access

```sql
-- Name: Service role has full access
-- Operation: ALL

CREATE POLICY "Service role can do everything"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'room-photos');
```

### Step 3: Test It!

1. Go to your app: http://localhost:3000/admin/rooms/new

2. You should now see:
   - **Drag & Drop area** for images
   - **Choose File button**
   - **Or paste URL** option

3. Try uploading an image!

---

## ✨ Features

### Drag & Drop Upload
- Drag any image file onto the upload area
- Instant upload to Supabase Storage
- Shows progress indicator

### File Picker
- Click "Choose File" to browse
- Select JPG, PNG, or WebP
- Max 5MB file size

### URL Option
- Still supports pasting image URLs
- Click "Or paste image URL instead"
- Works with Unsplash, Imgur, etc.

### Preview & Remove
- See uploaded image immediately
- Click X to remove and re-upload
- Image stored safely in Supabase

---

## 🔒 Security Features

- ✅ File type validation (only images)
- ✅ File size limit (5MB max)
- ✅ Unique filenames (no conflicts)
- ✅ Public read, authenticated write
- ✅ Service role has full access

---

## 📁 File Storage Details

### File Naming
Format: `room-{timestamp}-{random}.{ext}`

Example: `room-1699876543210-abc123def.jpg`

### Storage Location
```
Supabase Storage
└── room-photos/
    ├── room-1699876543210-abc123def.jpg
    ├── room-1699876544321-xyz789ghi.png
    └── ...
```

### Public URLs
Format: `https://xpzzvuaqiytgnaychoea.supabase.co/storage/v1/object/public/room-photos/filename.jpg`

---

## 🧪 Testing

### Test Upload:
1. Go to Create Room
2. Drag an image or click "Choose File"
3. Should see upload progress
4. Image appears as preview
5. Submit form
6. Check room card shows uploaded image

### Test URL Method:
1. Click "Or paste image URL instead"
2. Paste: `https://images.unsplash.com/photo-1497366216548-37526070297c?w=800`
3. Should show preview immediately

---

## 🐛 Troubleshooting

### Upload fails with "bucket not found"
**Fix**: Make sure you created the `room-photos` bucket (exact name)

### Upload fails with "permission denied"
**Fix**: Check storage policies are set correctly (step 2 above)

### Images not showing on cards
**Fix**: Make sure bucket is marked as **Public**

### "File too large" error
**Fix**: Images must be under 5MB. Compress large images first.

---

## 💡 Pro Tips

### Image Optimization:
- Use 1200x800px for best results
- Compress images before upload (tinypng.com)
- Keep under 1MB for faster loading
- Use landscape orientation

### Recommended Tools:
- **Compress**: https://tinypng.com
- **Resize**: https://imageresizer.com
- **Edit**: Canva, Photoshop, GIMP

### Best Practices:
- Upload high-quality photos of actual rooms
- Use consistent lighting
- Show room from best angle
- Avoid photos with people
- Update photos when room changes

---

## 📊 Storage Limits

**Supabase Free Tier:**
- 1 GB storage
- Approximately 1,000 room photos (@ 1MB each)
- More than enough for most organizations

**If you need more:**
- Upgrade to Supabase Pro ($25/month)
- 100 GB storage included
- Can handle 10,000+ photos

---

## 🔄 Migration

### Already have rooms with URLs?
No problem! The system supports both:
- ✅ Uploaded images (in Supabase Storage)
- ✅ External URLs (Unsplash, Imgur, etc.)
- ✅ Mix of both

You can edit existing rooms and upload new photos to replace URLs.

---

## ✅ Success Checklist

After setup, verify:
- [ ] `room-photos` bucket exists
- [ ] Bucket is marked as Public
- [ ] Storage policies are set
- [ ] Can upload image in Create Room form
- [ ] Image appears as preview
- [ ] Can remove and re-upload
- [ ] URL paste option still works
- [ ] Room cards display uploaded images

---

**You're all set! Upload away! 📸**

