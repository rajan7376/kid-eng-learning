import Link from "next/link";

export default function HomePage() {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-extrabold text-brand mb-3">
        🦊 單字動物王國
      </h1>
      <p className="text-slate-600 max-w-xl mx-auto mb-8">
        管理員上傳講義照片或 PDF，AI 自動整理成單字卡。學生登入後可以聽真人發音、慢速跟讀、做聽力測驗自動對答案，答對收集可愛動物、打造自己的動物王國！
      </p>
      <div className="flex justify-center gap-4">
        <Link
          href="/login"
          className="rounded-full bg-brand text-white px-6 py-3 font-bold card-shadow hover:bg-violet-600"
        >
          登入開始
        </Link>
      </div>
    </div>
  );
}
