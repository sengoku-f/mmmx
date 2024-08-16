// 生成唯一id
function generateUniqueID() {
  // 生成一串 UUID 字符串
  const uuid = crypto.randomUUID().toString().replaceAll("-", "");
  // 从 UUID 字符串中随机截取 8 个字符
  const start = Math.floor(Math.random() * (uuid.length - 8));
  return uuid.substr(start, 8);
}

module.exports = function (md) {
  const defaultRender = md.renderer.rules.paragraph_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.paragraph_open = function (tokens, idx, options, env, self) {

    // 添加一个唯一的ID
    // const uniqueID = generateUniqueID()
    tokens[idx].attrs = tokens[idx].attrs || [];
    tokens[idx].attrs.push(['id',  generateUniqueID()]);

    // 调用默认的渲染函数
    return defaultRender(tokens, idx, options, env, self);
  };
};