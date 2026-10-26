import { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(
    props: ImgHTMLAttributes<HTMLImageElement>,
) {
    return <img {...props} src="/assets/img/web/ched.png" alt="CHED Logo" />;
}
