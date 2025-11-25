import Navbar from "@/components/Navbar";
import './globals.css'

export const metadata = {
  title: "JourneyLens",
  description: "",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className='navbar'>
          <Navbar  />
        </div>
        {children}
      </body>
    </html>
  );
}
