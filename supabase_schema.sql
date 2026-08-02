-- Draft Ethan SNS Marketing Automation Supabase SQL Setup

-- 1. Create marketing_logs table
CREATE TABLE IF NOT EXISTS public.marketing_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    topic TEXT NOT NULL,
    thread_text TEXT NOT NULL,
    insta_caption TEXT NOT NULL,
    card_news_slides JSONB NOT NULL,
    card_news_urls TEXT[],
    threads_post_id TEXT,
    instagram_post_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL_SUCCESS')),
    error_message TEXT
);

-- Index for quick sorting by creation date
CREATE INDEX IF NOT EXISTS idx_marketing_logs_created_at ON public.marketing_logs(created_at DESC);

-- 2. Create Storage Bucket for Card News (Public Access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-cardnews', 'marketing-cardnews', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Public Read Policy for Storage Bucket
CREATE POLICY "Public Read Access for Card News"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-cardnews');

-- 4. Service Role Insert Policy for Storage Bucket
CREATE POLICY "Allow Service Role Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketing-cardnews');
