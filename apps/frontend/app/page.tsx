import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold text-primary-900">
                MedCore HMS
              </span>
            </div>
            <div className="flex gap-3">
              <Link href="/auth/login" className="btn-primary">
                Sign In
              </Link>
              <Link href="/auth/register" className="btn-secondary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-3xl">
          <h1 className="text-5xl font-bold text-primary-900 mb-6">
            Modern Hospital Management
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            End-to-end clinical and administrative workflows for hospitals,
            clinics, and diagnostic centers. Built for scale, designed for care.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/login" className="btn-primary text-lg px-8 py-3">
              Access Dashboard
            </Link>
            <a
              href="http://localhost:3001/api/docs"
              target="_blank"
              className="btn-secondary text-lg px-8 py-3"
            >
              API Documentation
            </a>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 text-left">
            <div className="card">
              <div className="text-3xl font-bold text-primary-600 mb-1">9</div>
              <div className="text-sm text-gray-600">Role Types</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-medical-600 mb-1">
                25+
              </div>
              <div className="text-sm text-gray-600">Database Models</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-primary-600 mb-1">
                100%
              </div>
              <div className="text-sm text-gray-600">Type Safe</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
