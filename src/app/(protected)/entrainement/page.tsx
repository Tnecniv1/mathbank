'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
export default function EntrainementIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/session'); }, [router]);
  return null;
}
