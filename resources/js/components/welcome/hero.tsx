// resources/js/components/welcome/hero.tsx

export default function WelcomeHero({
    stats,
}: {
    stats?: { institutions: number; programs: number };
}) {
    return (
        <section className="mb-6 mt-2 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            {/* Left side: title */}
            <div className="lg:col-span-8">
                <div className="mb-3 flex items-center gap-3">
                    <div className="rounded-full bg-white/70 p-2 shadow dark:bg-gray-900/70">
                        <img
                            src="/assets/img/ched-logo.png"
                            alt="CHED Logo"
                            className="h-14 w-14 object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">
                            Commission on Higher Education
                        </h1>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Regional Office XII
                        </p>
                    </div>
                </div>

                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-blue-900 dark:text-blue-300 md:text-5xl">
                    CHECK with CHED
                </h2>
                <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                    Verify institutional programs and permits quickly and securely.
                </p>
            </div>

            {/* Right side: stats */}
            <div className="grid grid-cols-2 gap-3 lg:col-span-4">
                <div className="rounded-xl bg-white/90 p-4 shadow dark:bg-gray-900/90">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total Institutions
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {stats?.institutions ?? '—'}
                    </p>
                </div>
                <div className="rounded-xl bg-white/90 p-4 shadow dark:bg-gray-900/90">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total Programs
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {stats?.programs ?? '—'}
                    </p>
                </div>
            </div>
        </section>
    );
}
