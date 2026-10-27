import { Compass } from 'lucide-react';
import { Button, EmptyState, PageBody, PageHeader } from '../components/ui';

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <PageBody>
        <EmptyState
          icon={Compass}
          title="This page doesn’t exist"
          description="The link may be old or mistyped."
          action={<Button variant="solid" label="Go to dashboard" to="/" />}
        />
      </PageBody>
    </>
  );
}
