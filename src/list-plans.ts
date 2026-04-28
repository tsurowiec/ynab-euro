import { api } from "./client.js";

const { data } = await api.plans.getPlans();

for (const b of data.plans) {
  console.log(`${b.id}  ${b.name}`);
}
