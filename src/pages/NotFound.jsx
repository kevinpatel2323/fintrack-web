import { Compass } from 'lucide-react';
import { Button, EmptyState, MobileActionBar, PageBody, PageHeader } from '../components/ui';
import { useIsCompact } from '../styles/breakpoints.js';
import './NotFound.css';

export default function NotFound() {
  const isMobile = useIsCompact();

  // Phones: a pushed page (Back in the header), the way home in the action bar.
  if (isMobile) {
    return (
      <>
        <PageHeader title="Page not found" />
        <PageBody className="nf-m-page">
          <EmptyState icon={Compass} title="This page doesn’t exist" description="The link may be old or mistyped." />
        </PageBody>
        <MobileActionBar>
          <Button size="lg" variant="solid" label="Go to Home" to="/" />
        </MobileActionBar>
      </>
    );
  }

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
