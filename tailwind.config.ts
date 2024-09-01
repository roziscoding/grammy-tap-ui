import type { Config } from 'tailwindcss'
import catppuccin from '@catppuccin/tailwindcss'

export default <Partial<Config>>{
  plugins: [
    catppuccin({
      defaultFlavour: 'mocha',
    }),
  ],
}
