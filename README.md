# antd-form-schema
> A tiny headless schema renderer for Ant Design form fields and rules.

[![version][version-image]][version-url]
[![license][license-image]][license-url]
[![download][download-image]][download-url]

## installation
```shell
pnpm add @jswork/antd-form-schema
```

## usage
  ```js
  import AntdFormSchema from '@jswork/antd-form-schema';
  import '@jswork/antd-form-schema/style.css';

  function App() {
    return (
      <div className="m-10 p-4 shadow bg-gray-100 text-gray-800 hover:shadow-md transition-all">
        <div className="badge badge-warning absolute right-0 top-0 m-4">
          Build Time: {BUILD_TIME}
        </div>
        <AntdFormSchema className="debug-red">
          abc
        </AntdFormSchema>
      </div>
    );
  }

  export default App;
  ```

## preview
- https://afeiship.github.io/antd-form-schema/

## license
Code released under [the MIT license](https://github.com/afeiship/antd-form-schema/blob/master/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/antd-form-schema
[version-url]: https://npmjs.org/package/@jswork/antd-form-schema

[license-image]: https://img.shields.io/npm/l/@jswork/antd-form-schema
[license-url]: https://github.com/afeiship/antd-form-schema/blob/master/LICENSE.txt

[download-image]: https://img.shields.io/npm/dm/@jswork/antd-form-schema
[download-url]: https://www.npmjs.com/package/@jswork/antd-form-schema
