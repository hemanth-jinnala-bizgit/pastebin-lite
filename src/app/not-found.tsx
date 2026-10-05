import { Header } from "@/components/Header";
import { IconLink } from "@/components/icons";

export default function NotFound() {
  return (
    <>
      <Header email={null} />
      <main className="page">
        <div className="empty">
          <div className="empty-art round" aria-hidden="true"><IconLink width={36} height={36} /></div>
          <h1 className="empty-title">This note isn&rsquo;t available</h1>
          <p className="muted">
            The link may be wrong, the note may have expired
            <br />
            or reached its view limit, or it was deleted.
          </p>
        </div>
      </main>
    </>
  );
}
