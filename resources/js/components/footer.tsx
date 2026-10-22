// resources/js/components/footer.tsx
import React from 'react';

interface FooterProps {
    copyright?: string;
    tagline?: string;
}

const Footer: React.FC<FooterProps> = ({
    copyright = `© ${new Date().getFullYear()} Commission on Higher Education, Regional Office XII.`,
    tagline = 'Beripika · Programs and Permits Registry',
}) => {
    return (
        <footer className="mt-16 w-full border-t">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                    <img
                        src="/assets/img/ched-logo.png"
                        alt=""
                        className="size-7 object-contain"
                    />
                    <span className="font-medium text-foreground">
                        {tagline}
                    </span>
                </div>
                <p>{copyright}</p>
            </div>
        </footer>
    );
};

export default Footer;
