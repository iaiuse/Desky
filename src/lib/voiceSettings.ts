import { db } from './db';

export const defaultVoices = [
  { id: "male-qn-qingse", name: "青涩青年音色" },
  { id: "male-qn-jingying", name: "精英青年音色" },
  { id: "male-qn-badao", name: "霸道青年音色" },
  { id: "male-qn-daxuesheng", name: "青年大学生音色" },
  { id: "female-shaonv", name: "少女音色" },
  { id: "female-yujie", name: "御姐音色" },
  { id: "female-chengshu", name: "成熟女性音色" },
  { id: "female-tianmei", name: "甜美女性音色" },
  { id: "presenter_male", name: "男性主持人" },
  { id: "presenter_female", name: "女性主持人" },
  { id: "audiobook_male_1", name: "男性有声书1" },
  { id: "audiobook_male_2", name: "男性有声书2" },
  { id: "audiobook_female_1", name: "女性有声书1" },
  { id: "audiobook_female_2", name: "女性有声书2" },
  { id: "male-qn-qingse-jingpin", name: "青涩青年音色-beta" },
  { id: "male-qn-jingying-jingpin", name: "精英青年音色-beta" },
  { id: "male-qn-badao-jingpin", name: "霸道青年音色-beta" },
  { id: "male-qn-daxuesheng-jingpin", name: "青年大学生音色-beta" },
  { id: "female-shaonv-jingpin", name: "少女音色-beta" },
  { id: "female-yujie-jingpin", name: "御姐音色-beta" },
  { id: "female-chengshu-jingpin", name: "成熟女性音色-beta" },
  { id: "female-tianmei-jingpin", name: "甜美女性音色-beta" },
  { id: "clever_boy", name: "聪明男童" },
  { id: "cute_boy", name: "可爱男童" },
  { id: "lovely_girl", name: "萌萌女童" },
  { id: "cartoon_pig", name: "卡通猪小琪" },
  { id: "bingjiao_didi", name: "病娇弟弟" },
  { id: "junlang_nanyou", name: "俊朗男友" },
  { id: "chunzhen_xuedi", name: "纯真学弟" },
  { id: "lengdan_xiongzhang", name: "冷淡学长" },
  { id: "badao_shaoye", name: "霸道少爷" },
  { id: "tianxin_xiaoling", name: "甜心小玲" },
  { id: "qiaopi_mengmei", name: "俏皮萌妹" },
  { id: "wumei_yujie", name: "妩媚御姐" },
  { id: "diadia_xuemei", name: "嗲嗲学妹" },
  { id: "danya_xuejie", name: "淡雅学姐" },
  { id: "Santa_Claus", name: "Santa Claus" },
  { id: "Grinch", name: "Grinch" },
  { id: "Rudolph", name: "Rudolph" },
  { id: "Arnold", name: "Arnold" },
  { id: "Charming_Santa", name: "Charming Santa" },
  { id: "Charming_Lady", name: "Charming Lady" },
  { id: "Sweet_Girl", name: "Sweet Girl" },
  { id: "Cute_Elf", name: "Cute Elf" },
  { id: "Attractive_Girl", name: "Attractive Girl" },
  { id: "Serene_Woman", name: "Serene Woman" }
];

export async function initializeVoiceSettings() {
  try {
    const existingVoices = await db.settings.get('voices');
    if (!existingVoices) {
      await db.settings.put({ key: 'voices', value: defaultVoices });
      console.log('Default voices initialized in database');
    }
  } catch (error) {
    console.error('Error initializing voice settings:', error);
  }
}

export async function updateVoiceSettings(voices: Array<{ id: string, name: string }>) {
  try {
    await db.settings.put({ key: 'voices', value: voices });
    console.log('Voice settings updated successfully');
  } catch (error) {
    console.error('Error updating voice settings:', error);
  }
}