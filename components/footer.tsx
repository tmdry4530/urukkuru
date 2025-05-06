import { Twitter } from "lucide-react"

export function Footer() {
  return (
    <>
      {/* Announcement Bar */}
      <div className="w-full bg-gradient-to-r from-pink-900/30 to-purple-900/30 backdrop-blur-sm py-3 px-4 text-center text-sm">
        제 1회 당첨자 : OOO 몇개 당첨 / 당첨자 이름이랑 몇개 당첨인지 나오게 전광판으로 굴러가기?
      </div>

      {/* Footer */}
      <footer className="w-full bg-black/60 backdrop-blur-md border-t border-purple-500/30 py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <Twitter className="h-5 w-5 text-purple-400 mr-2" />
            <span className="text-sm text-gray-400">CA: </span>
            <span className="text-sm text-purple-300 ml-2">0x000...000</span>
          </div>

          <button className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium py-2 px-6 rounded-md transition-all duration-300 transform hover:scale-105">
            토큰구매
          </button>
        </div>
      </footer>
    </>
  )
}
