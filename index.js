'use strict'
/**
 * deps
 */
const Promise = require('bluebird')
const request = require('request-promise-native-res')
const { exec } = require('child_process')
const ip6 = require('ip6')

/**
 * functions
 */
async function execAsync(command) {
  let child = exec(command)
  return new Promise((resolve, reject) => {
    let { stdout, stderr } = child
    stdout.on('data', console.info)
    stderr.on('data', console.error)
    // child.on('close', code => console.info('closing code: ' + code))
    child.addListener('error', reject)
    child.addListener('exit', resolve)
  })
}

async function getMyIface() {
  let ni = require('os').networkInterfaces()
  let iface =
    Object.keys(ni).includes('eth0') && 'eth0' ||
    Object.keys(ni).includes('venet0') && 'venet0'
  console.info('getMyIface: ', iface)
  return Promise.resolve(iface)
}

async function getMyIpv4() {
  let res = await request.nativeRes({
    url: 'http://ipv4.icanhazip.com',
    family: 4,
  })
  const ip = res.body.replace(/\n/gi, '')
  console.info('getMyIpv4: ', ip)
  return ip
}

async function getMyIpv6() {
  let res = await request.nativeRes({
    url: 'http://ipv6.icanhazip.com',
    family: 6,
  })
  const ip = res.body.replace(/\n/gi, '')
  // console.info('getMyIpv6: ', ip)
  return ip
}

/**
 * @returns an array of deployedIps
 */
async function getDeployedIps() {
  // getDeployedIps()
  let ni = require('os').networkInterfaces()
  let iface = await getMyIface()
  let myIp = await getMyIpv6()
  console.info('getDeployedIps iface: ', iface)
  return Promise
    .map(ni[iface], i => {
      if (i.family === 'IPv6' && i.scopeid === 0)
        return i.address
      return null
    })
    .filter(Boolean)
    .filter(ip => ip !== myIp)
}

/**
 * it disables(removes) all but localhost's ipv6 ips for the current network interface
 * @returns: array of undeployed ips
 */
async function flushDeployedIps(ips) {
  let iface = await getMyIface()
  console.info('flushDeployedIps iface: ', iface)
  let deployedIps = await getDeployedIps()
  let myIp = await getMyIpv6()

  // flushDeployedIps()
  return Promise.each(deployedIps, async ip => {
    if (ip === myIp)
      return
    // ip -6 addr del 2a04:ac00:0004:29bb:84a4:0595:53b2:53ef dev eth0
    let shellCommand = `ip -6 addr del ${ip} dev ${iface}`
    try {
      console.info('ip is flushing: ', ip)
      return await execAsync(shellCommand)
    } catch (err) {
      console.info(err)
    }
  })
}

/**
 * it generates some ipv6 ips
 * enables them for usage on the current[or given] network interface
 * @returns: array of deployued ips
 */
async function deployIps(data = {}) {
  /**
   * vars
   */
  let { iface, subnet, amount } = data

  iface = iface || await getMyIface()
  subnet = subnet || await getMyIpv6()
  amount = amount || 10

  // generateIps()
  let ips = ip6.randomSubnet(subnet.trim(), 64, 128, amount, true)

  // deployIps()
  return Promise.each(ips, async ip => {
    // ip -6 addr add 2a04:ac00:0004:29bb:84a4:0595:53b2:53ef dev eth0
    let shellCommand = `ip -6 addr add ${ip} dev ${iface}`
    try {
      return await execAsync(shellCommand)
    } catch (err) {
      console.info('err: ', err)
      return
    }
  })
}

/**
 * exports
 */
let ipv6DeployTool = {
  getMyIpv4,
  getMyIpv6,
  getMyIface,
  getDeployedIps,
  deployIps,
  flushDeployedIps,
}

module.exports = ipv6DeployTool
