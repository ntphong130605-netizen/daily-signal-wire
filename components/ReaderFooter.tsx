import Link from "next/link";
import Logo from "@/components/Logo";

export default function ReaderFooter() {
  return (
    <footer className="reader-footer">
      <div className="reader-footer-inner">
        <Logo inverse />
        <p>Original reporting signals. Human-reviewed publishing.</p>
        <nav aria-label="Footer navigation">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy-policy">Privacy</Link>
          <Link href="/cookie-policy">Cookies</Link>
          <Link href="/editorial-policy">Editorial Policy</Link>
          <Link href="/ai-content-policy">AI Content Policy</Link>
          <Link href="/ai-transparency">AI Transparency</Link>
          <Link href="/fact-check-policy">Fact-Check Policy</Link>
          <Link href="/corrections-policy">Corrections</Link>
          <Link href="/editorial-team">Editorial Team</Link>
          <Link href="/dmca">DMCA</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/admin">Newsroom</Link>
        </nav>
      </div>
    </footer>
  );
}
