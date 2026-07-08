import Header from "@/components/Header";
import ReaderFooter from "@/components/ReaderFooter";
import TopNav from "@/components/TopNav";

export default function ReaderShell({
  children,
  searchValue = ""
}: {
  children: React.ReactNode;
  searchValue?: string;
}) {
  return (
    <div className="reader-site">
      <Header />
      <TopNav searchValue={searchValue} />
      {children}
      <ReaderFooter />
    </div>
  );
}
