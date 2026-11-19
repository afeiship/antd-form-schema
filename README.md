# antd-form-schema

> A tiny headless schema binding library for Ant Design forms and rules.

The schema describes only **what a field is** — widget id, data, text, validation and conditions.
It never describes layout or style. All layout is plain `div` + Tailwind in your own JSX.

[![version][version-image]][version-url]
[![license][license-image]][license-url]

## Quick start

```shell
pnpm install
pnpm dev
pnpm test
pnpm build
```

`pnpm dev` starts the Vite example site with six interactive demos
(Basic Grid / Card Groups / Custom Widget / View-Edit / Conditional / Step Form).

## Documentation

- [Library README](./packages/lib/README.md) — API, widgets, conditions and view mode.
- [Final PRD](./docs/requirements/002-final-prd.md) — full specification and examples.

## Preview

- https://afeiship.github.io/antd-form-schema/

## License

Code released under [the MIT license](https://github.com/afeiship/antd-form-schema/blob/main/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/antd-form-schema
[version-url]: https://npmjs.org/package/@jswork/antd-form-schema

[license-image]: https://img.shields.io/npm/l/@jswork/antd-form-schema
[license-url]: https://github.com/afeiship/antd-form-schema/blob/main/LICENSE.txt
