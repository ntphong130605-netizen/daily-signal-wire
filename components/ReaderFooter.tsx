import Link from "next/link";
import Logo from "@/components/Logo";

export default function ReaderFooter() {
  return (
    <footer className="reader-footer">
      <div className="reader-footer-inner">
        <Logo inverse />
        <p>Original reporting signals. Human-reviewed publishing.</p>
        <nav aria-label="Footer navigation">
          <Link href="/">About</Link>
          <Link href="/">Standards</Link>
          <Link href="/">Privacy</Link>
          <Link href="/admin">Newsroom</Link>
        </nav>
      </div>
    </footer>
  );
}
