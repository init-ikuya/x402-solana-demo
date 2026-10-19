import AppKit
import CoreImage.CIFilterBuiltins
import Foundation

let profileURL = "https://github.com/init-ikuya"
let output = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ??
    "docs/topics/auth-capture/assets/github-profile-qr.png")
let filter = CIFilter.qrCodeGenerator()
filter.message = Data(profileURL.utf8)
filter.correctionLevel = "H"
guard let qr = filter.outputImage else {
    fatalError("Could not generate the profile QR code")
}
let scaled = qr.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
guard let image = CIContext().createCGImage(scaled, from: scaled.extent),
      let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
    fatalError("Could not encode the profile QR code")
}
try png.write(to: output)
