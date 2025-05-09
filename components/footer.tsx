import { Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-purple-500/30 py-4 px-4 font-joystix">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
        {/* Twitter Icon Link (Left Aligned) */}
        <a
          href="https://x.com/URUK_KURU"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center mb-4 md:mb-0 group hover:opacity-80 transition-opacity"
          aria-label="URUK Twitter Profile"
        >
          <Twitter className="h-5 w-5 text-purple-400 group-hover:text-pink-400 transition-colors" />
        </a>

        {/* Right Aligned Group: CA Info + Trade Button */}
        <div className="flex items-center">
          {/* CA Info (Left of Trade Button) */}
          <div className="flex items-center mr-6">
            {" "}
            {/* Added mr-6 for spacing */}
            <span className="text-sm text-gray-400">CA: </span>
            <span className="text-sm text-purple-300 ml-2">
              0xa63f39250fcec6d86fa3f68a3625326f5e438711
            </span>
          </div>

          {/* Trade Button */}
          <a
            href="https://www.kuru.io/trade/0x5d6506e92b0a1205bd717b66642e961edad0a884"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium py-2 px-6 rounded-md transition-all duration-300 transform hover:scale-105">
              Trade $URUK
            </button>
          </a>
        </div>
      </div>
    </footer>
  );
}
