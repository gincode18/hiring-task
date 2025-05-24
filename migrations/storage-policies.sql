-- Storage policies for chat attachments
-- Run these in Supabase Dashboard > SQL Editor

-- Policy to allow authenticated users to upload files
CREATE POLICY "Enable upload for authenticated users" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'attachments');

-- Policy to allow public read access to files
CREATE POLICY "Enable read access for all users" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'attachments');

-- Policy to allow users to delete their own files (optional)
CREATE POLICY "Enable delete for own files" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'attachments' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow users to update their own files (optional)
CREATE POLICY "Enable update for own files" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id = 'attachments' AND 
  auth.uid()::text = (storage.foldername(name))[1]
); 