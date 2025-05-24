# Chat Attachments Setup Guide

This guide explains how to set up file attachments for the chat system using Supabase Storage.

## Supabase Storage Setup

### 1. Create Storage Bucket

In your Supabase dashboard, go to **Storage** and create a new bucket:

1. Navigate to **Storage** > **Buckets**
2. Click **"Create Bucket"**
3. **Name**: `attachments`
4. **Public bucket**: **Yes** (for easy file access)
5. Click **"Create Bucket"**

### 2. Storage Policies (via Dashboard)

⚠️ **Important**: Storage policies must be created through the Supabase Dashboard, not via SQL queries.

After creating the bucket, set up policies:

1. Go to **Storage** > **Policies**
2. Select the `attachments` bucket
3. Click **"Add Policy"** for each policy below:

#### Upload Policy
- **Policy Name**: "Enable upload for authenticated users"
- **Allowed Operations**: `INSERT`
- **Target Roles**: `authenticated`
- **Policy Definition**:
```sql
bucket_id = 'attachments'
```

#### Read Policy  
- **Policy Name**: "Enable read access for all users"
- **Allowed Operations**: `SELECT`
- **Target Roles**: `public`
- **Policy Definition**:
```sql
bucket_id = 'attachments'
```

#### Delete Policy (Optional)
- **Policy Name**: "Enable delete for own files" 
- **Allowed Operations**: `DELETE`
- **Target Roles**: `authenticated`
- **Policy Definition**:
```sql
bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]
```

### 3. Alternative: Using Supabase CLI

If you prefer using the CLI, you can create policies with:

```bash
# Install Supabase CLI if you haven't
npm install -g @supabase/cli

# Login to your project
supabase login

# Create policies
supabase storage policies create --bucket-name attachments --policy-name "Enable upload for authenticated users" --operation INSERT --role authenticated --expression "bucket_id = 'attachments'"

supabase storage policies create --bucket-name attachments --policy-name "Enable read access for all users" --operation SELECT --role public --expression "bucket_id = 'attachments'"
```

### 4. Bucket Configuration

In the Supabase Dashboard:
1. Go to **Storage** > **Settings**
2. Set file size limit (recommended: 10MB)
3. Configure allowed file types:
   - Images: `image/*`
   - Videos: `video/*`
   - Audio: `audio/*`
   - Documents: `.pdf,.doc,.docx,.txt`

## Quick Setup Checklist

- [ ] Create `attachments` bucket (public)
- [ ] Add upload policy for authenticated users
- [ ] Add read policy for public access
- [ ] (Optional) Add delete policy for file owners
- [ ] Configure file size limits
- [ ] Test file upload functionality

## Features Implemented

### File Upload
- Drag & drop support
- Multiple file selection
- File type validation
- File size validation (10MB limit)
- Image preview generation
- Image compression for better performance

### Supported File Types
- **Images**: jpg, png, gif, webp, svg
- **Videos**: mp4, webm, mov, avi
- **Audio**: mp3, wav, ogg, m4a
- **Documents**: pdf, doc, docx, txt

### Message Types
The system now supports two message types:
- `text`: Regular text messages
- `attachment`: File attachments with metadata

### Attachment Metadata Structure
```json
{
  "fileName": "example.jpg",
  "fileUrl": "https://your-project.supabase.co/storage/v1/object/public/attachments/...",
  "fileSize": 1024000,
  "fileType": "image/jpeg",
  "originalSize": 2048000
}
```

## UI Features

### Chat Input
- Paperclip icon for general file uploads
- Image icon for image-specific uploads
- Attachment preview with remove option
- Upload progress indicator
- Drag & drop with visual feedback

### Message Display
- **Images**: Clickable thumbnails that open in new tab
- **Videos**: Embedded video player with controls
- **Audio**: Audio player with controls
- **Documents**: File icon with download button
- File size and name display

## Troubleshooting

### Common Issues

1. **"must be owner of table objects" error**
   - Solution: Use Supabase Dashboard to create policies, not SQL queries

2. **Upload fails with 403 error**
   - Check if upload policy is correctly configured
   - Verify user is authenticated
   - Ensure bucket exists and is public

3. **Files not loading/displaying**
   - Check if read policy allows public access
   - Verify file URLs are correct
   - Check browser console for CORS errors

4. **Large file upload failures**
   - Reduce file size limit in bucket settings
   - Implement chunked upload for large files
   - Check network connectivity

## Security Considerations

1. **File Size Limits**: Currently set to 10MB per file
2. **File Type Validation**: Client-side and server-side validation
3. **Authentication Required**: Only authenticated users can upload
4. **Storage Organization**: Files organized by chat ID for better management
5. **Image Compression**: Automatic compression to save storage space

## Usage

### Uploading Files
1. Click the paperclip icon or image icon
2. Select files from your device (or drag & drop)
3. Preview appears showing selected files
4. Type message (optional) and click send
5. Files upload and appear as messages

### Viewing Attachments
- **Images**: Click to view full size
- **Videos/Audio**: Use built-in media controls
- **Documents**: Click download icon to save

## Performance Optimizations

- Image previews generated client-side
- Automatic image compression (1920px max width, 80% quality)
- Lazy loading for media content
- Progress indicators for large files 