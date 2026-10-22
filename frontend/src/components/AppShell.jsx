import SiteHeader from './SiteHeader.jsx';
import MobileNav from './MobileNav.jsx';
import Icon from './Icon.jsx';

export default function AppShell({ children }) {
  return (
    <div className="ecosearch-app">
      <SiteHeader />
      <main>{children}</main>
      <footer className="site-footer page-width">
        <a className="footer-brand" href="#/"><Icon name="leaf" size={19} /> EcoSearch</a>
        <p>A little more informed. A little more sustainable.</p>
        <span>Made with tomorrow in mind <Icon name="leaf" size={14} /></span>
      </footer>
      <MobileNav />
    </div>
  );
}
