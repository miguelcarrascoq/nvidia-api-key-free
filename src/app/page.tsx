import { Playground } from '@/components/playground';
import { hasNvidiaApiKey } from '@/lib/nvidia';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <Playground apiKeyConfigured={hasNvidiaApiKey()} />;
}
