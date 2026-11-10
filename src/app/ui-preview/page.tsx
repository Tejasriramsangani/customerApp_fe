import { notFound } from 'next/navigation';
import { CustomerUiPreview } from '../../components/preview/CustomerUiPreview';
export default function PreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <CustomerUiPreview />;
}
