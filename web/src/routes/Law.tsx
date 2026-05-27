import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { fetchLawBody, downloadLaw } from '../api/laws.js';
import { LawViewer } from '../components/LawViewer/LawViewer.js';

export function LawPage() {
  const { lawId } = useParams({ from: '/law/$lawId' });
  const [downloading, setDownloading] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const query = useQuery({
    queryKey: ['lawBody', lawId, retryToken],
    queryFn: () => fetchLawBody(lawId),
    retry: false,
  });

  // Auto-prompt download if 404
  const notDownloaded = useMemo(() => {
    const err = query.error as Error | undefined;
    return Boolean(err && /^404/.test(err.message));
  }, [query.error]);

  useEffect(() => {
    if (!notDownloaded || downloading) return;
    void (async () => {
      setDownloading(true);
      try {
        await downloadLaw(lawId);
        setRetryToken((n) => n + 1);
      } catch (e) {
        console.error(e);
      } finally {
        setDownloading(false);
      }
    })();
  }, [notDownloaded, downloading, lawId]);

  if (query.isLoading) return <div className="p-6 text-sm">読み込み中…</div>;
  if (downloading) {
    return (
      <div className="p-6 text-sm">
        e-Gov 法令API から取得中… ({lawId})
      </div>
    );
  }
  if (query.error && !notDownloaded) {
    return (
      <div className="p-6 text-sm text-red-600">
        エラー: {String(query.error)}
      </div>
    );
  }
  if (!query.data) return null;

  return <LawViewer body={query.data} />;
}
