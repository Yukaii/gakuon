import { useEffect } from 'react';
import "./Popup.css";
import { BANNER } from '../../utils/banner.ts'

export default function() {
  useEffect(() => {
    console.log("Hello from the popup!");
  }, []);

  return (
    <div>
      <img src="/icon-with-shadow.svg" />
      <h1>vite-plugin-web-extension</h1>
      <p>
        Template: <code>react-ts</code>
      </p>
      <pre>
        { BANNER }
      </pre>
    </div>
  )
}
