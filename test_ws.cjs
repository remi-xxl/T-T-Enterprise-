const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  const rep = await p.user.findFirst()
  const prod = await p.product.findFirst()
  console.log('REP', rep && rep.id, 'PROD', prod && prod.id, 'price', prod && prod.price)
  await p.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
