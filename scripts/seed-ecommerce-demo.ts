// /**
//  * One-shot: seed eCommerce (catalog + marketplace) demo data for Pronix
//  * without dropping the database.
//  *
//  * Usage (from maestro/):
//  *   npx ts-node --transpile-only -r tsconfig-paths/register scripts/seed-ecommerce-demo.ts
//  */
//
// process.env.ENABLED_MODULES =
//     process.env.ENABLED_MODULES || "propertyManagement,eCommerce";
//
// import mongoose from "mongoose";
// import {connectToMongoDb} from "maestro/modules/core/connections/connectToMongoDb";
// import Company from "maestro/modules/core/database/schemas/company/company";
// import {getLogger} from "maestro/modules/core/loggers/serverLog";
// import {seedCompanyDemoData as seedECommerce} from "maestro/modules/eCommerce/database/companyDemoSeed";
// import {seedCompanyDemoData as seedMarketplace} from "maestro/modules/eCommerce/database/marketplaceCompanyDemoSeed";
//
// async function main() {
//     const logger = getLogger("seed_ecommerce_demo");
//     logger.start("Connecting and seeding ecommerce demo data...");
//
//     await connectToMongoDb(logger, false);
//
//     const company = await Company.findOne({name: "Pronix", vat: "Z123456789Z"});
//     if (!company) {
//         throw new Error("Pronix company not found — cannot seed ecommerce demo.");
//     }
//
//     logger.info(`Seeding against company ${company.name} (${company._id})`);
//     await seedECommerce(logger, company);
//     await seedMarketplace(logger, company);
//
//     logger.finish("Ecommerce demo seed complete.");
//     await mongoose.disconnect();
//     process.exit(0);
// }
//
// main().catch(async (err) => {
//     console.error(err);
//     try {
//         await mongoose.disconnect();
//     } catch {
//         /* ignore */
//     }
//     process.exit(1);
// });
